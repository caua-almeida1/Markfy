function generateClientId() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 12)
    );
}

export function getClientId() {

    let clientId =
        localStorage.getItem("markfy-client-id");

    if (!clientId) {

        clientId = generateClientId();

        localStorage.setItem(
            "markfy-client-id",
            clientId
        );

    }

    return clientId;
}