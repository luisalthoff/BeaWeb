    const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const APP_STORAGE_KEY = "beaWebData_v1";
    const DATA_VERSION = 1;
    const APP = {
        schemaVersion: DATA_VERSION,
        trainerId: null,
        sessionDuration: 60,      
    };
    const STATUS_ORDER = ["reserved", "attended", "cancelled", "noshow"];
    const STATUS_ICON = {
        reserved: '<span class="whiteBall"></span>',
        attended: "🟢",
        cancelled: "🔵",
        noshow: "🔴",
        single: "🟣",
    };
