import { app } from './app.js';
import { seedIfEmpty } from './seed.js';
import { startScheduler } from './lifecycle.js';

seedIfEmpty();
startScheduler();

// In dev (`npm run dev`), PORT belongs to the Vite server, so the API listens
// on API_PORT (default 3000), which Vite proxies /api to. In production
// (`npm start`) this one server serves everything on PORT.
const dev = process.argv.includes('--dev');
const port = Number(process.env.API_PORT || (dev ? 3000 : process.env.PORT)) || 3000;
app.listen(port, () => console.log(`Rungs ${dev ? 'API ' : ''}running at http://localhost:${port}`));
