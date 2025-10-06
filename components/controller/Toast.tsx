
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: ((toast: ToastMessage) => void)[] = [];

const toast = {
  success: (message: string) => notify({ id: toastId++, message, type: 'success' }),
  error: (message: string) => notify({ id: toastId++, message, type: 'error' }),
  info: (message: string) => notify({ id: toastId++, message, type: 'info' }),
};

function notify(toast: ToastMessage) {
  listeners.forEach((listener) => listener(toast));
}

const Toast: React.FC<{ message: ToastMessage; onDismiss: (id: number) => void }> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(message.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [message, onDismiss]);

    const baseClasses = "flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow-xl";
    const typeClasses = {
        success: "text-green-800 bg-green-100",
        error: "text-red-800 bg-red-100",
        info: "text-blue-800 bg-blue-100",
    };
    const iconClasses = {
        success: "ph-bold ph-check-circle",
        error: "ph-bold ph-x-circle",
        info: "ph-bold ph-info",
    };

    return (
        <div className={`${baseClasses} ${typeClasses[message.type]} animate-fade-in`} role="alert">
            <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg`}>
                <i className={`${iconClasses[message.type]} text-xl`}></i>
            </div>
            <div className="ml-3 text-sm font-normal">{message.message}</div>
            <button
                type="button"
                className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8"
                onClick={() => onDismiss(message.id)}
                aria-label="Close"
            >
                <i className="ph-bold ph-x"></i>
            </button>
        </div>
    );
};


const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const addToast = (toast: ToastMessage) => {
            setToasts((currentToasts) => [...currentToasts, toast]);
        };

        listeners.push(addToast);
        return () => {
            const index = listeners.indexOf(addToast);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, []);
    
    const onDismiss = useCallback((id: number) => {
        setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));
    }, []);

    const portalElement = document.body;
    
    return ReactDOM.createPortal(
        <div className="fixed top-5 right-5 z-50">
            {toasts.map((toast) => (
                <Toast key={toast.id} message={toast} onDismiss={onDismiss} />
            ))}
        </div>,
        portalElement
    );
};


export { ToastContainer, toast };
