-- KEYS[1] = bucket key (e.g., "ratelimit:myapp:192.168.1.1")
-- ARGV[1] = capacity (number)
-- ARGV[2] = refillRate (tokens per ms)
-- ARGV[3] = now (timestamp ms)
-- ARGV[4] = ttlMs (bucket TTL in ms)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastRefill = now
end

local elapsed = now - lastRefill
local newTokens = elapsed * refillRate
tokens = math.min(capacity, tokens + newTokens)
lastRefill = now

local allowed = false
local remaining = 0
local retryAfter = 0
local reset = 0

if tokens >= 1 then
  tokens = tokens - 1
  allowed = true
  remaining = math.floor(tokens)
  reset = lastRefill + math.ceil((capacity - tokens) / refillRate)
else
  allowed = false
  remaining = 0
  local tokensNeeded = 1 - tokens
  local retryAfterMs = math.ceil(tokensNeeded / refillRate)
  retryAfter = math.ceil(retryAfterMs / 1000)
  reset = lastRefill + math.ceil((capacity - tokens) / refillRate)
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill, 'capacity', capacity, 'refillRate', refillRate)
redis.call('PEXPIRE', key, ttlMs)

return {allowed and 1 or 0, remaining, reset, retryAfter}