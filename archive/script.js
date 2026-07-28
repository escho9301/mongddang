(function () {
    function getNumberFormat(val) {
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    $.get("data.json").then(function (res) {
        var todayCount = getNumberFormat(res.todayCount);
        var totalCount = getNumberFormat(res.totalCount);
        $("#todayCount").text(todayCount);
        $("#totalCount").text(totalCount);
    });
})();