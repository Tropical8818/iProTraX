import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Type definition for global augmentation
const globalForRedis = global as unknown as {
    redis: Redis | undefined,
    subscriber: Redis | undefined
};

export const redis = globalForRedis.redis || new Redis(redisUrl || 'redis://localhost:6379');
export const subscriber = globalForRedis.subscriber || new Redis(redisUrl || 'redis://localhost:6379');

if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis;
    globalForRedis.subscriber = subscriber;
}

redis.on('error', (err) => console.error('Redis Client Error', err));
subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
