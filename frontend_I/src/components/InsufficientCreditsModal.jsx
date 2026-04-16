import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Modal shown when a user tries to upload/extract with 0 credits.
 * Props:
 *   open  – boolean
 *   onClose – () => void
 */
const InsufficientCreditsModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-8 max-w-sm w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Insufficient Credits</h3>
          <p className="text-sm text-slate-500 mb-6">
            You've used all your free credits. Purchase more to continue extracting financial data from PDFs.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { onClose(); navigate('/pricing'); }}
              className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Buy Credits
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsufficientCreditsModal;
