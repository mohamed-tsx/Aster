import { toast } from "sonner";

export const useToast = () => {
    const showToast = {
        success: (message: string, description?: string) => {
            toast.success(message, {
                description,
                duration: 4000,
            });
        },
        error: (message: string, description?: string) => {
            toast.error(message, {
                description,
                duration: 5000,
            });
        },
        warning: (message: string, description?: string) => {
            toast.warning(message, {
                description,
                duration: 4000,
            });
        },
        info: (message: string, description?: string) => {
            toast.info(message, {
                description,
                duration: 4000,
            });
        },
        loading: (message: string, description?: string) => {
            return toast.loading(message, {
                description,
            });
        },
        dismiss: (toastId?: string | number) => {
            toast.dismiss(toastId);
        },
    };

    return showToast;
};