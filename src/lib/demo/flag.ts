import { env } from '$env/dynamic/public';

/**
 * Demo mode (the Railway copy): all data lives in the browser's localStorage,
 * the server never touches a database, and form posts are intercepted
 * client-side. Toggled by deploying with PUBLIC_DEMO=1.
 */
export const isDemo = env.PUBLIC_DEMO === '1';
