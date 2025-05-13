const generateCode = () => {
    return `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };
  
  module.exports = generateCode;
