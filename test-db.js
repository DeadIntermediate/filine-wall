import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    console.log('Testing MariaDB connection...');

    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'filine_wall'
    });

    console.log('Connection successful!');

    // Test creating the database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS filine_wall');
    console.log('Database filine_wall created or already exists');

    // Test a simple query
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('MariaDB Version:', rows[0].version);

    await connection.end();
    console.log('Connection closed successfully');

  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();