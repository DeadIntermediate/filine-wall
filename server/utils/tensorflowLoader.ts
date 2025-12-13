/**
 * TensorFlow.js Optional Loader
 * Gracefully handles systems where TensorFlow is not compatible (e.g., 32-bit ARM)
 */

let tf: any = null;
let tfAvailable = false;

try {
  // Try to load TensorFlow
  tf = require('@tensorflow/tfjs-node');
  tfAvailable = true;
  console.log('✓ TensorFlow.js loaded successfully');
} catch (error: any) {
  // TensorFlow failed to load (likely wrong architecture)
  tfAvailable = false;
  
  if (error.code === 'ERR_DLOPEN_FAILED') {
    console.warn('⚠ TensorFlow.js not available (incompatible architecture - likely 32-bit ARM)');
    console.warn('  ML features (voice analysis, NLP detection) will be disabled');
    console.warn('  Core call blocking functionality is not affected');
  } else {
    console.warn('⚠ TensorFlow.js failed to load:', error.message);
  }
  
  // Provide mock TensorFlow API to prevent crashes
  tf = {
    tensor: () => { throw new Error('TensorFlow not available'); },
    loadLayersModel: () => { throw new Error('TensorFlow not available'); },
    sequential: () => { throw new Error('TensorFlow not available'); },
  };
}

export { tf, tfAvailable };
export default tf;
