module.exports = {
  webpack: {
    configure: (config) => {
      config.resolve.fallback = {
        crypto: require.resolve("crypto-browserify"),
      };
      return config;
    },
  },
};