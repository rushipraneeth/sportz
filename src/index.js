import express from 'express';
import { router } from "./routes/matches.js";

const app = express();
const port = 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from Express server!');
});

app.use('/matches', router);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});