export class FailureReporterMock {
    reports = [];
    report = (report) => {
        this.reports.push(report);
    };
}
//# sourceMappingURL=failure-reporter-mock.js.map