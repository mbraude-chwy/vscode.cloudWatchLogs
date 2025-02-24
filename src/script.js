const fieldTypeToMatchFunction = {
    "shortCol": (field) => !field.includes("time") && !field.includes("message") && !field.includes("msg"),
    "medCol": (field) => field.includes("time"),
    "longCol": (field) => field.includes("message") || field.includes("msg")
};

function getColTypeIndexes(fieldNames, specialField) {
    return fieldNames.
        map(field => field.toLowerCase()).
        map((field, index) => fieldTypeToMatchFunction[specialField](field) ? index + 1 : undefined).
        filter(value => value != undefined);
}

function handleFields(fieldNames) {

    $('.tableContainer').
        empty().
        append(tableContainerInnerHtml);

    $("#toggles").
        append(fieldNames.map((fieldName, index) => `<a class="toggle-vis" data-column="${index + 1}">${fieldName}</a>`).join(" - "))

    $("#resultsTableHead").
        append("<th></th>").
        append(fieldNames.map(fieldName => `<th>${fieldName}</th>`).join());

    const table =
        $('#resultsTable').DataTable(
            {
                lengthMenu: [100, 500, 1000],
                ordering: true,
                order: [],
                paging: false,
                scrollY: '60vh',
                scrollCollapse: true,
                orderClasses: false,
                colReorder: true,

                columnDefs: [
                    { targets: [0], className: "btnCol", orderable: false },
                    { targets: getColTypeIndexes(fieldNames, "shortCol"), className: "shortCol" },
                    { targets: getColTypeIndexes(fieldNames, "medCol"), className: "medCol" },
                    { targets: getColTypeIndexes(fieldNames, "longCol"), className: "longCol" }
                ],
                createdRow: function (row) {
                    $(row).find("td, th").each(function () {
                        $(this).attr("title", this.innerText);
                    });
                }
            });

    $('a.toggle-vis').on('click', function (e) {
        e.preventDefault();
        var column = table.column($(this).attr('data-column'));
        column.visible(!column.visible());
        $(this).css('text-decoration', column.visible() ? 'underline' : 'none')
    });
}

function handleResults(fieldNames, regionToQueryResultsMap) {

    const timeFieldName = fieldNames.find(fieldName => fieldName.toLowerCase().includes("time"));
    let timeAndRegionAndFieldNameToValue = [];
    for ([region, queryResults] of Object.entries(regionToQueryResultsMap)) {
        for (queryResult of queryResults.results) {
            const fieldNameToValueMap =
                new Map(
                    queryResult.map(
                        queryResultField => [
                            queryResultField.field,
                            queryResultField.value]));

            timeAndRegionAndFieldNameToValue.push([fieldNameToValueMap.get(timeFieldName), region, fieldNameToValueMap]);
        }
    }

    if (Object.keys(regionToQueryResultsMap).length > 1 &&
        timeFieldName != undefined) {
        timeAndRegionAndFieldNameToValue =
            timeAndRegionAndFieldNameToValue.sort(([time], [otherTime]) => new Date(otherTime) - new Date(time));
    }

    $('#resultsCount').text(timeAndRegionAndFieldNameToValue.length);

    const table = $('#resultsTable').DataTable().clear();

    for ([_, region, fieldNameToValueMap] of timeAndRegionAndFieldNameToValue) {

        table.row.add([
            `<button onclick="goToLog(\'${fieldNameToValueMap.get("@ptr")}\', \'${region}\')">🔍</button>`,
            ...fieldNames.map(fieldName => fieldNameToValueMap.get(fieldName))
        ]);
    }

    table.draw();
}

$(document).ready(function () {
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'results':
                if (message.fieldRefresh) {
                    handleFields(message.fieldNames);
                }

                handleResults(
                    message.fieldNames,
                    message.regionToQueryResultsMap);

                break;
        }
    });
});

// consts function for page events
const vscode = acquireVsCodeApi();
const goToLog = (recordPtr, region) => vscode.postMessage({ command: 'goToLog', text: recordPtr, region });
const refresh = () => vscode.postMessage({ command: 'refresh', query: $("#rawQuery")[0].textContent });
const refreshOnCtrlEnter = () => {
    if (event.key === 'Enter' && event.ctrlKey) {
        refresh()
    }
}
const formatPastedText = () => {
    event.preventDefault();
    const textNode = document.createTextNode(event.clipboardData.getData("text/plain"));
    const selection = window.getSelection();
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(textNode);
    selection.setPosition(textNode, textNode.length);
}
const duplicate = () => {
    vscode.postMessage({
        command: 'duplicate'
    });
}
const changeTitle = () => {
    vscode.postMessage({
        command: 'changeTitle'
    });
}
const openRaw = () => {
    const table = $('#resultsTable').DataTable();
    const visibleColumns = table.columns().visible();

    visibleColumns[0] = false; // button

    const fieldNames =
        table.
            columns().
            header().
            filter((_, index) => visibleColumns[index]).
            map(header => header.innerText).
            toArray();

    const rows =
        table.
            rows({ search: "applied" }).
            data().
            map(row => row.filter((_, index) => visibleColumns[index])).
            toArray();

    vscode.postMessage({
        command: 'openRaw',
        fieldNames,
        rows
    });
}