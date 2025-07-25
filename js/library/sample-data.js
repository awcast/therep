/**
 * Sample Component Data - Initialize library with example components
 */

const SAMPLE_COMPONENTS = [
    {
        name: "ATmega328P",
        category: "microcontrollers",
        package: "TQFP-32",
        value: "ATmega328P-AU",
        description: "8-bit AVR microcontroller with 32KB Flash, 2KB SRAM, and 1KB EEPROM",
        manufacturer: "Microchip Technology",
        datasheet: "https://www.microchip.com/wwwproducts/en/ATmega328P",
        tags: ["arduino", "avr", "8-bit", "microcontroller"],
        specifications: [
            { parameter: "Flash Memory", value: "32", unit: "KB" },
            { parameter: "SRAM", value: "2", unit: "KB" },
            { parameter: "EEPROM", value: "1", unit: "KB" },
            { parameter: "Operating Voltage", value: "1.8-5.5", unit: "V" },
            { parameter: "Max Clock Frequency", value: "20", unit: "MHz" },
            { parameter: "I/O Pins", value: "23", unit: "" },
            { parameter: "ADC Channels", value: "8", unit: "" },
            { parameter: "PWM Channels", value: "6", unit: "" }
        ]
    },
    {
        name: "LM358",
        category: "op-amps",
        package: "SOIC-8",
        value: "LM358D",
        description: "Dual operational amplifier with wide supply voltage range",
        manufacturer: "Texas Instruments",
        datasheet: "https://www.ti.com/product/LM358",
        tags: ["op-amp", "dual", "general-purpose"],
        specifications: [
            { parameter: "Supply Voltage", value: "3-32", unit: "V" },
            { parameter: "Input Offset Voltage", value: "2", unit: "mV" },
            { parameter: "Gain Bandwidth Product", value: "1.1", unit: "MHz" },
            { parameter: "Slew Rate", value: "0.3", unit: "V/µs" },
            { parameter: "Common Mode Rejection Ratio", value: "85", unit: "dB" },
            { parameter: "Operating Temperature", value: "-40 to +85", unit: "°C" }
        ]
    },
    {
        name: "ESP32-WROOM-32",
        category: "microcontrollers",
        package: "Module",
        value: "ESP32-WROOM-32",
        description: "WiFi + Bluetooth module with dual-core Xtensa LX6 MCU",
        manufacturer: "Espressif Systems",
        datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf",
        tags: ["wifi", "bluetooth", "iot", "dual-core", "32-bit"],
        specifications: [
            { parameter: "CPU", value: "Dual-core Xtensa LX6", unit: "" },
            { parameter: "Clock Frequency", value: "240", unit: "MHz" },
            { parameter: "Flash Memory", value: "4", unit: "MB" },
            { parameter: "SRAM", value: "520", unit: "KB" },
            { parameter: "WiFi Standards", value: "802.11 b/g/n", unit: "" },
            { parameter: "Bluetooth", value: "v4.2 BR/EDR and BLE", unit: "" },
            { parameter: "GPIO Pins", value: "34", unit: "" },
            { parameter: "Operating Voltage", value: "3.0-3.6", unit: "V" }
        ]
    },
    {
        name: "1N4007",
        category: "diodes",
        package: "DO-41",
        value: "1N4007",
        description: "General purpose silicon rectifier diode",
        manufacturer: "Various",
        datasheet: "",
        tags: ["rectifier", "general-purpose", "silicon"],
        specifications: [
            { parameter: "Peak Repetitive Reverse Voltage", value: "1000", unit: "V" },
            { parameter: "Average Forward Current", value: "1", unit: "A" },
            { parameter: "Forward Voltage Drop", value: "1.1", unit: "V" },
            { parameter: "Reverse Recovery Time", value: "30", unit: "µs" },
            { parameter: "Operating Temperature", value: "-65 to +175", unit: "°C" }
        ]
    },
    {
        name: "2N2222A",
        category: "transistors",
        package: "TO-92",
        value: "2N2222A",
        description: "NPN general purpose transistor",
        manufacturer: "Various",
        datasheet: "",
        tags: ["npn", "general-purpose", "switching"],
        specifications: [
            { parameter: "Collector-Emitter Voltage", value: "40", unit: "V" },
            { parameter: "Collector Current", value: "800", unit: "mA" },
            { parameter: "Current Gain (hFE)", value: "100-300", unit: "" },
            { parameter: "Transition Frequency", value: "250", unit: "MHz" },
            { parameter: "Power Dissipation", value: "625", unit: "mW" },
            { parameter: "Operating Temperature", value: "-65 to +200", unit: "°C" }
        ]
    },
    {
        name: "AMS1117-3.3",
        category: "voltage-regulators",
        package: "SOT-223",
        value: "AMS1117-3.3",
        description: "Low dropout linear voltage regulator, 3.3V output",
        manufacturer: "Advanced Monolithic Systems",
        datasheet: "",
        tags: ["ldo", "linear", "3.3v", "regulator"],
        specifications: [
            { parameter: "Output Voltage", value: "3.3", unit: "V" },
            { parameter: "Input Voltage", value: "4.5-15", unit: "V" },
            { parameter: "Output Current", value: "1", unit: "A" },
            { parameter: "Dropout Voltage", value: "1.3", unit: "V" },
            { parameter: "Line Regulation", value: "2", unit: "mV" },
            { parameter: "Load Regulation", value: "5", unit: "mV" },
            { parameter: "Operating Temperature", value: "-40 to +125", unit: "°C" }
        ]
    },
    {
        name: "HC-SR04",
        category: "sensors",
        package: "Module",
        value: "HC-SR04",
        description: "Ultrasonic distance sensor module",
        manufacturer: "Various",
        datasheet: "",
        tags: ["ultrasonic", "distance", "sensor", "module"],
        specifications: [
            { parameter: "Operating Voltage", value: "5", unit: "V" },
            { parameter: "Operating Current", value: "15", unit: "mA" },
            { parameter: "Ranging Distance", value: "2-400", unit: "cm" },
            { parameter: "Resolution", value: "0.3", unit: "cm" },
            { parameter: "Measuring Angle", value: "15", unit: "°" },
            { parameter: "Trigger Input Pulse", value: "10", unit: "µs" },
            { parameter: "Operating Temperature", value: "-15 to +70", unit: "°C" }
        ]
    },
    {
        name: "74HC595",
        category: "logic",
        package: "SOIC-16",
        value: "74HC595D",
        description: "8-bit serial-in, serial or parallel-out shift register",
        manufacturer: "Various",
        datasheet: "",
        tags: ["shift-register", "serial", "parallel", "cmos"],
        specifications: [
            { parameter: "Supply Voltage", value: "2-6", unit: "V" },
            { parameter: "Output Current", value: "7.5", unit: "mA" },
            { parameter: "Propagation Delay", value: "13", unit: "ns" },
            { parameter: "Clock Frequency", value: "25", unit: "MHz" },
            { parameter: "Operating Temperature", value: "-40 to +85", unit: "°C" }
        ]
    }
];

/**
 * Initialize sample data in the component library
 */
async function initializeSampleData(componentManager) {
    try {
        console.log('Initializing sample component data...');
        
        for (const component of SAMPLE_COMPONENTS) {
            try {
                await componentManager.addComponent(component);
                console.log(`Added sample component: ${component.name}`);
            } catch (error) {
                console.warn(`Failed to add component ${component.name}:`, error);
            }
        }
        
        console.log('Sample data initialization complete');
        return true;
    } catch (error) {
        console.error('Failed to initialize sample data:', error);
        return false;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.initializeSampleData = initializeSampleData;
    window.SAMPLE_COMPONENTS = SAMPLE_COMPONENTS;
}
