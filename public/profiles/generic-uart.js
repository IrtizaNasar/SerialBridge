/**
 * Generic UART Profile (Arduino/ESP32)
 * 
 * Implements the Nordic Semiconductor UART Service (NUS) standard.
 * This is the most common way to do "Serial over BLE".
 */

(function () {
    // BLE UART Service UUIDs (Nordic UART Service standard)
    const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to this
    const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Read from this

    function parseGenericUART(dataView) {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(dataView);
    }

    window.registerProfile('generic_uart', {
        name: 'Generic UART (Arduino/ESP32)',
        service: UART_SERVICE_UUID,
        characteristic: UART_TX_CHAR_UUID,  // RX from device (read)
        writeCharacteristic: UART_RX_CHAR_UUID,  // Legacy name
        txCharacteristic: UART_RX_CHAR_UUID,  // TX to device (write)
        parser: parseGenericUART
    });
})();
