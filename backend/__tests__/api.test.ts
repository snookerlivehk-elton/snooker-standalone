import request from 'supertest';
import express from 'express';

const app = express();
app.get('/', (req, res) => {
  res.status(200).send({ message: 'Hello world' });
});

describe('GET /', () => {
  it('should respond with a 200 status code and a message', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Hello world' });
  });
});