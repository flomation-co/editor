import Cookies from 'js-cookie';

export default function useCookieToken() {
    const cookie = Cookies.get('flomation-token');
    if (!cookie) {
        return null;
    }

    return "" + cookie;
}