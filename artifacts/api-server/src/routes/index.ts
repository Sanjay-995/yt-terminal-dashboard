import { Router, type IRouter } from "express";
import healthRouter from "./health";
import youtubeRouter from "./youtube";
import authRouter from "./auth";
import zernioRouter from "./zernio";
import youtubeOAuthRouter from "./youtube-oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(youtubeOAuthRouter);
router.use(zernioRouter);
router.use(youtubeRouter);

export default router;
