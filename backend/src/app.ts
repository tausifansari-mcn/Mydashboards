import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import logger from './lib/logger';

import authRoutes from './modules/auth/auth.routes';
import clientRoutes from './modules/clients/clients.routes';
import userRoutes from './modules/users/users.routes';
import processRoutes from './modules/processes/processes.routes';
import dashboardRoutes from './modules/dashboards/dashboards.routes';
import auditRoutes from './modules/audit/audit.routes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/users', userRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));

export default app;
