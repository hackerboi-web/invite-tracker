import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import guildsRouter from "./guilds";
import invitesRouter from "./invites";
import premiumRouter from "./premium";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(guildsRouter);
router.use(invitesRouter);
router.use(premiumRouter);

export default router;
