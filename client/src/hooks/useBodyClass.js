import { useEffect } from 'react';

// The legacy page stylesheets scope their <body> rules to a class (menu-page, cart-page, auth-page).
export default function useBodyClass(name) {
  useEffect(() => {
    document.body.classList.add(name);
    return () => document.body.classList.remove(name);
  }, [name]);
}
