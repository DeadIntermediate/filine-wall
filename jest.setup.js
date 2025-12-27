// jest.setup.js
const { jest } = require('@jest/globals');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock external dependencies that might not be available in test environment
jest.mock('node-vad', () => ({
  createStream: jest.fn(() => ({
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock TensorFlow.js if not available
try {
  require('@tensorflow/tfjs-node');
} catch (error) {
  jest.mock('@tensorflow/tfjs-node', () => ({
    tensor: jest.fn(),
    sequential: jest.fn(() => ({
      add: jest.fn(),
      compile: jest.fn(),
      fit: jest.fn(),
      predict: jest.fn()
    }))
  }));
}