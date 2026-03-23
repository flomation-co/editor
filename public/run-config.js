const local = {
    AUTOMATE_API_URL: 'http://localhost:9080',
    TRIGGER_URL: 'http://localhost:9999',
    LOGIN_URL: 'http://localhost:8999',
}

const dev = {
    AUTOMATE_API_URL: 'https://api.dev.flomation.app',
    TRIGGER_URL: 'https://launch.dev.flomation.app',
    LOGIN_URL: 'https://id.dev.flomation.app',
}

const live = {
    AUTOMATE_API_URL: 'https://api.flomation.app',
    TRIGGER_URL: 'https://launch.flomation.app',
    LOGIN_URL: 'https://id.flomation.app',
}

window.properties = {
    ...local
    // ...dev
    // ...live
}