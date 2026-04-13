import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.info(
    `[server] msg-bridge running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`,
  );
});
