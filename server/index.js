import { app } from './app.js';
import { seedIfEmpty } from './seed.js';

seedIfEmpty();

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Rungs running at http://localhost:${port}`));
