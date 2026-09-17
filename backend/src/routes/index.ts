import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import departmentRoutes from './departmentRoutes';
import templateRoutes from './templateRoutes';
import employeeRoutes from './employeeRoutes';
import documentRoutes from './documentRoutes';
import assistantRoutes from './assistantRoutes';
import libraryDocumentRoutes from './libraryDocumentRoutes';
import trainingRoutes from './trainingRoutes';
import analyticsRoutes from './analyticsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/templates', templateRoutes);
router.use('/employees', employeeRoutes);
router.use('/documents', documentRoutes);
router.use('/assistant', assistantRoutes);
router.use('/library-documents', libraryDocumentRoutes);
router.use('/training', trainingRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
