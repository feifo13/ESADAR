import { useMobileMenu } from './MobileMenuContext.jsx';

export function useNotification() {
  const {
    notify,
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning,
  } = useMobileMenu();

  return {
    notify,
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning,
  };
}
