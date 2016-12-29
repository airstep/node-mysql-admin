/** @jsx m */

import m from 'mithril'
import stream from 'mithril/stream'
import Http from '../service/Http'
import TableList from '../component/TableList'
import TableListRow from '../component/TableListRow'
import Tab from '../component/Tab'
import Tabs from '../component/Tabs'

export default  {

    dbname: null,
    tablename: null,
    columns: [],
    rows: [],
    limit: 10,
    page: 1,
    response: {},

    oninit: function (vnode) {
        this.page = vnode.attrs.page || 1
        this.dbname = vnode.attrs.dbname
        this.tablename = vnode.attrs.tablename || null
    },

    oncreate: function (vnode) {

        var self = this

        if(this.tablename) {
            self.listColumns()
        }

    },

    onTableSelect: function (table) {
        this.tablename = table
        this.listColumns()
    },

    listColumns () {
        var self = this

        self.columns = []
        self.rows = []

        Http
            .post("/table/column/list", {
                dbname: self.dbname,
                tablename: self.tablename
            })
            .then(function (r) {

            if(r.code == 200) {
                self.columns = r.payload
            } else {
                self.response = r
            }

            //after columns
            self.listRows(self.page)
        })
    },

    listRows : function () {

        var self = this

        Http.post("/table/rows", {
            dbname: self.dbname, tablename: self.tablename,
            limit: self.limit, offset: (parseInt(self.page) - 1) * self.limit
        }).then(function (r) {

            if(r.code == 200) {
                for (var j = 0; j < r.payload.length; j++) {

                    var row = r.payload[j]

                    // map row data to this obj using m.prop()
                    var tempRowData = {}


                    for (var i = 0; i < self.columns.length; i++) {

                        var column = self.columns[i]

                        tempRowData[column.Field] = {}

                        tempRowData[column.Field]["_isEditing"] = false
                        tempRowData[column.Field]["data"] = stream(row[column.Field])
                    }

                    self.rows.push(tempRowData)
                }
            } else {
                self.response = r
            }



        })
    },

    hasRows: function () {
        return this.rows.length > 0
    },

    loadOld: function () {
        this.page = this.page - 1
        this.rows = []
        this.listRows()
    },

    loadNew: function () {
        this.page = this.page + 1
        this.rows = []
        this.listRows()
    },

    view: function () {

        var self = this

        return (
            <div>

                <div className="w3-row">

                    <div className="w3-col m3">
                        <TableList dbname={self.dbname} onTableSelect={self.onTableSelect.bind(self)}/>
                    </div>

                    <div className="w3-col" style={"width:10px;"}>&nbsp;</div>

                    <div className="w3-rest">

                        <Tabs>
                            <Tab label="Columns">
                                <table className="w3-table-all w3-hoverable">

                                    <thead>
                                    <tr>
                                        {
                                            self.columns.map(function (r) {
                                                return <th>{r.Field}</th>
                                            })
                                        }
                                    </tr>
                                    </thead>

                                    <tbody>

                                        {
                                            self.rows.map(function (row) {

                                                return (
                                                <tr>
                                                    {
                                                        self.columns.map(function (column) {

                                                            return <TableListRow
                                                                dbname={self.dbname}
                                                                tablename={self.tablename}
                                                                row={row}
                                                                column={column}
                                                                />
                                                        })
                                                    }
                                                </tr>
                                                )

                                            })
                                        }
                                    </tbody>
                                </table>

                                {
                                    self.hasRows() ?
                                    <ul class="w3-pagination w3-borde">
                                        <li><a onclick={self.loadOld.bind(self)}>&laquo;</a></li>
                                        <li><a onclick={self.loadNew.bind(self)}>&raquo;</a></li>
                                    </ul> : ''
                                }

                            </Tab>


                            {/* query section */}
                            <Tab label="Query">Query</Tab>
                        </Tabs>

                    </div>

                </div>

            </div>
        );
    }

}