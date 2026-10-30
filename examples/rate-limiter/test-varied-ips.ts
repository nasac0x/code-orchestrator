import { createMetricsCollector } from './src/metrics';
import { rateLimitConfig } from './src/config/rate-limit';
import { createRateLimiter } from './src/middleware/rate-limiter';
import Fastify from 'fastify';

async function runVariedIPsTest() {
  console.log('🧪 TESTE COM IPS VARIADOS E ÚNICOS\n');
  
  const app = Fastify({ logger: false });
  
  const metrics = createMetricsCollector(rateLimitConfig);
  const rateLimiterHook = createRateLimiter({ config: rateLimitConfig, metrics });
  app.addHook('onRequest', rateLimiterHook);
  
  app.get('/api/test', async () => ({ ok: true }));
  app.get('/api/metrics', async () => metrics.getSnapshot());
  
  await app.listen({ port: 3004, host: '0.0.0.0' });
  console.log('🚀 Servidor em http://localhost:3004\n');
  
  // Gera IPs REALMENTE DIFERENTES (não sequenciais)
  // Mistura ranges privados + públicos simulados
  const ips = generateVariedIPs(100);
  
  console.log(`📋 Gerados ${ips.length} IPs únicos:`);
  console.log(`   Range: ${ips[0]} ... ${ips[ips.length-1]}`);
  console.log(`   Primeiros 10: ${ips.slice(0, 10).join(', ')}`);
  console.log(`   Últimos 10: ${ips.slice(-10).join(', ')}\n`);
  
  // Cada IP faz 15 requisições (acima do limite de 10)
  const reqsPerIP = 15;
  console.log(`⚡ Disparando ${reqsPerIP} reqs por IP (${ips.length * reqsPerIP} total)...\n`);
  
  const startTime = Date.now();
  let totalAllowed = 0;
  let totalBlocked = 0;
  const ipResults = new Map<string, {allowed: number, blocked: number}>();
  
  // Executa em lotes para não sobrecarregar
  const batchSize = 20;
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (ip) => {
      const results = { allowed: 0, blocked: 0 };
      
      for (let r = 0; r < 15; r++) {
        try {
          const res = await fetch('http://localhost:3004/api/test', {
            headers: { 'x-forwarded-for': ip }
          });
          if (res.status === 200) results.allowed++;
          else if (res.status === 429) results.blocked++;
        } catch (e) {
          // ignore
        }
      }
      
      ipResults.set(ip, results);
    }));
    
    // Progress
    const done = Math.min(i + batchSize, ips.length);
    console.log(`   Progresso: ${done}/${ips.length} IPs`);
  }
  
  const duration = Date.now() - startTime;
  
  // Agrega resultados
  for (const [ip, r] of ipResults) {
    totalAllowed += r.allowed;
    totalBlocked += r.blocked;
  }
  
  // Métricas finais
  const snap = await metrics.getSnapshot();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTADO FINAL');
  console.log('='.repeat(50));
  console.log(`⏱️  Tempo total: ${Date.now() - startTime}ms`);
  console.log(`✅ Permitidas (200): ${totalAllowed}`);
  console.log(`🚫 Bloqueadas (429): ${totalBlocked}`);
  console.log(`📈 Taxa de bloqueio: ${((totalBlocked/(totalAllowed+totalBlocked))*100).toFixed(1)}%`);
  
  console.log('\n📊 MÉTRICAS DO COLETOR:');
  console.log(`   Total requests: ${snap.requests.total}`);
  console.log(`   Permitidas: ${snap.requests.allowed}`);
  console.log(`   Bloqueadas: ${snap.requests.blocked}`);
  console.log(`   Taxa bloqueio: ${(snap.requests.blockRate*100).toFixed(1)}%`);
  console.log(`   Latência avg: ${snap.latency.avg.toFixed(1)}ms | p99: ${snap.latency.p99}ms`);
  console.log(`   Buckets ativos: ${snap.activeBuckets}`);
  console.log(`   Redis: ${snap.redis.connected ? 'Conectado' : 'Memória'}`);
  
  console.log('\n🏆 TOP 10 IPs POR REQUESTS:');
  snap.topIPs.byRequests.slice(0, 10).forEach((ip, idx) => {
    const r = ipResults.get(ip.ip) || {allowed: 0, blocked: 0};
    console.log(`   ${idx+1}. ${ip.ip.padEnd(18)} | Total: ${ip.count} | 200: ${r.allowed} | 429: ${r.blocked}`);
  });
  
  console.log('\n🚫 TOP 10 IPs POR BLOQUEIOS:');
  snap.topIPs.byBlocks.slice(0, 10).forEach((ip, idx) => {
    const r = ipResults.get(ip.ip) || {allowed: 0, blocked: 0};
    console.log(`   ${idx+1}. ${ip.ip.padEnd(18)} | Blocks: ${ip.count} | 200: ${r.allowed} | 429: ${r.blocked}`);
  });
  
  // Verifica se TODOS os IPs são únicos no collector
  console.log(`\n🔍 Verificação: ${snap.topIPs.byRequests.length} IPs únicos rastreados (esperado: 100)`);
  console.log(`   Memória: ${snap.redis.connected ? 'Redis' : 'In-Memory'}`);
  
  await app.close();
  process.exit(0);
}

function generateVariedIPs(count: number): string[] {
  const ips = new Set<string>();
  
  // Ranges variados para IPs realmente diferentes
  const ranges = [
    // Classes privadas
    () => `10.${random(0,255)}.${random(0,255)}.${random(1,254)}`,
    () => `172.1${random(6,31)}.${random(0,255)}.${random(1,254)}`,
    () => `192.168.${random(0,255)}.${random(1,254)}`,
    
    // Simulando ranges públicos (CGNAT, ISPs)
    () => `${random(1,223)}.${random(0,255)}.${random(0,255)}.${random(1,254)}`,
    () => `${random(1,223)}.${random(0,255)}.${random(0,255)}.${random(1,254)}`,
    () => `${random(1,223)}.${random(0,255)}.${random(0,255)}.${random(1,254)}`,
    
    // IPv6 simulado (últimos 32 bits)
    () => `::ffff:${random(1,223)}.${random(0,255)}.${random(0,255)}.${random(1,254)}`,
  ];
  
  while (ips.size < count) {
    const generator = ranges[random(0, ranges.length - 1)];
    ips.add(generator());
  }
  
  // Embaralha para não vir em ordem sequencial
  return Array.from(ips).sort(() => Math.random() - 0.5);
}

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Executa
runVariedIPsTest().catch(console.error);