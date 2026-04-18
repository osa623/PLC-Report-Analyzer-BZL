const { createApp } = require('./app');
const config = require('./config');

const app = createApp();
app.listen(config.port, () => {
  console.log(`Node backend listening on port ${config.port}`);
});
