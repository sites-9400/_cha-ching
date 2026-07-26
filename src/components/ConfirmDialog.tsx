interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  onConfirm: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Delete", secondaryLabel, onConfirm, onSecondary, onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-1">{title}</h3>
        <p className="text-sm text-stone-500 mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void onConfirm()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600">
            {confirmLabel}
          </button>
        </div>
        {onSecondary && (
          <button
            onClick={() => void onSecondary()}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-red-700 bg-red-50"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
