import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚀 Vektor HCM Backend API listening on port ${config.port}`);
  console.log(`🌐 Base URL: http://localhost:${config.port}/api/v1`);
});
