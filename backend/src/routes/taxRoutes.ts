import { Router } from 'express';
import { getActiveTaxes, getAllTaxes, createTax, updateTaxStatus } from '../modules/seller/controllers/taxController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Mounted at /seller/taxes — seller-only tax management (admin has its own
// separate, admin-gated tax endpoints under /admin).
router.use(authenticate);
router.use(requireUserType('Seller'));

// Get active taxes for selection
router.get('/active', getActiveTaxes);

// Get all taxes for management
router.get('/', getAllTaxes);

// Create tax (Admin should ideally do this, but seller management has a page for it in this app it seems)
router.post('/', createTax);

// Update tax status
router.patch('/:id/status', updateTaxStatus);

export default router;
