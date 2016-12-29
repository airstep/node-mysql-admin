/** @jsx m */

import m from 'mithril'
import Http from '../service/Http'

export default  {

    tables: [],
    dbname: null,
    selectedTable: null,
    response: {},

    oninit: function (vnode) {
        this.dbname = vnode.attrs.dbname
    },

    oncreate: function () {
        this.listTables()
    },

    listTables: function () {
        var self = this

        Http.post("/table/list", {dbname: this.dbname}).then(function (r) {

            if(r.code == 200) {
                self.tables = r.payload
            } else {
                self.response = r
            }
        })
    },

    _onTableSelect: function (table, onTableSelect) {
        this.selectedTable = table
        onTableSelect(table)
    },

    view: function (vnode) {

        var self = this

        return (
            <div>

                <table className="w3-table-all w3-hoverable">
                    <thead>
                        <tr><th>Table name</th></tr>
                    </thead>
                    <tbody>

                    {
                        self.tables.map(function (table) {

                            var isActive = ""

                            if(table === self.selectedTable) {
                                isActive = "w3-green"
                            }

                            return (
                                <tr key={table} className={isActive}>
                                    <td
                                    onclick={self._onTableSelect.bind(self, table, vnode.attrs.onTableSelect)}
                                    >
                                        {table}
                                    </td>
                                </tr>
                            )
                        })
                    }

                    </tbody>
                </table>
            </div>
        );
    }

}