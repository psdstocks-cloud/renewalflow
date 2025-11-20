import { Router } from 'express';
import { artlyAuth } from '../middleware/artlyAuth';
import {
  processPointsEvents,
  processSubscriptions,
  processUsers,
  processCharges,
} from '../services/artlyService';

export const artlyRouter = Router();

artlyRouter.post('/artly/sync/points-events', artlyAuth, async (req, res, next) => {
  try {
    const result = await processPointsEvents(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/subscriptions', artlyAuth, async (req, res, next) => {
  try {
    const result = await processSubscriptions(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/users', artlyAuth, async (req, res, next) => {
  try {
    const result = await processUsers(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/charges', artlyAuth, async (req, res, next) => {
  try {
    const result = await processCharges(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
