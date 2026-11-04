typedef int SECStatus;
#define SECSuccess 0
SECStatus NSS_VersionCheck(const char *importVersion) {
    (void)importVersion;
    return SECSuccess;
}
