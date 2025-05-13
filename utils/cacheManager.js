const NodeCache = require('node-cache');

// Initialize cache with standard TTL of 1 hour (in seconds)
const cache = new NodeCache({ 
  stdTTL: process.env.CACHE_TTL || 3600,
  checkperiod: 120,  // Check for expired keys every 2 minutes
  useClones: false   // For better performance when storing large objects
});

// Track data versions and last updated timestamps
const cacheMetadata = new Map();

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {any} - Cached data or null if not found
 */
const getCache = (key) => {
  try {
    // Check if data exists in cache
    const data = cache.get(key);
    if (!data) return null;
    
    // Return the data with its metadata for freshness check
    const metadata = cacheMetadata.get(key) || { version: 1, timestamp: Date.now() };
    return {
      data,
      metadata
    };
  } catch (error) {
    console.error(`Cache get error for key '${key}':`, error);
    return null;
  }
};

/**
 * Set data in cache with versioning
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @param {number} retries - Number of retries for DB operations (optional)
 * @returns {boolean} - True if successful
 */
const setCache = (key, data, ttl = undefined, retries = 3) => {
  try {
    // Update the metadata for this key
    const currentMeta = cacheMetadata.get(key) || { version: 0, timestamp: 0 };
    const newMeta = {
      version: currentMeta.version + 1,
      timestamp: Date.now()
    };
    cacheMetadata.set(key, newMeta);
    
    console.log(`Cache updated for '${key}', version: ${newMeta.version}`);
    return cache.set(key, data, ttl);
  } catch (error) {
    // Check if error is related to MongoDB connection
    if (error.message && error.message.includes('MongoDB connection')) {
      console.error(`MongoDB connection error while caching '${key}'. Vercel deployments require MongoDB Atlas to allow connections from anywhere (0.0.0.0/0).`);
      
      // If we have retries left, try again after a short delay
      if (retries > 0) {
        console.log(`Retrying cache operation for '${key}', ${retries} attempts remaining...`);
        setTimeout(() => setCache(key, data, ttl, retries - 1), 1000);
      }
    } else {
      console.error(`Cache set error for key '${key}':`, error);
    }
    return false;
  }
};

/**
 * Delete data from cache and update version
 * @param {string} key - Cache key
 * @returns {number} - Number of deleted entries
 */
const deleteCache = (key) => {
  try {
    // Update version even on deletion to track changes
    const currentMeta = cacheMetadata.get(key) || { version: 0, timestamp: 0 };
    cacheMetadata.set(key, {
      version: currentMeta.version + 1,
      timestamp: Date.now()
    });
    
    console.log(`Cache invalidated for '${key}'`);
    return cache.del(key);
  } catch (error) {
    console.error(`Cache delete error for key '${key}':`, error);
    return 0;
  }
};

/**
 * Force refresh of a specific cache entry by fetching new data
 * @param {string} key - Cache key 
 * @param {Function} fetchFunction - Async function to fetch fresh data
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {any} - Fresh data
 */
const refreshCache = async (key, fetchFunction, ttl = undefined) => {
  try {
    console.log(`Forcibly refreshing cache for '${key}'`);
    const freshData = await fetchFunction();
    setCache(key, freshData, ttl);
    return freshData;
  } catch (error) {
    console.error(`Error refreshing cache for '${key}':`, error);
    throw error; // Re-throw to handle in the caller
  }
};

/**
 * Check if cache is stale based on timestamp
 * @param {string} key - Cache key
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {boolean} - True if cache entry is stale
 */
const isStale = (key, maxAgeMs = 30000) => { // Default 30 seconds
  const metadata = cacheMetadata.get(key);
  if (!metadata) return true;
  
  const ageMs = Date.now() - metadata.timestamp;
  return ageMs > maxAgeMs;
};

/**
 * Clear all cache data
 * @returns {boolean} - True if successful
 */
const flushCache = () => {
  try {
    cacheMetadata.clear();
    cache.flushAll();
    return true;
  } catch (error) {
    console.error('Cache flush error:', error);
    return false;
  }
};

/**
 * Get cache metadata
 * @returns {Object} - Cache metadata
 */
const getMetadata = (key = null) => {
  if (key) {
    return cacheMetadata.get(key);
  }
  
  // Convert Map to regular object for all keys
  const metadata = {};
  cacheMetadata.forEach((value, key) => {
    metadata[key] = value;
  });
  return metadata;
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  refreshCache,
  isStale,
  flushCache,
  getMetadata,
  getStats: () => cache.getStats()
};
