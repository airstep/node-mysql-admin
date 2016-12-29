/** @jsx m */

import m from 'mithril'
import Http from '../service/Http'

export default  {

    tablename: null,
    dbname: null,
    row: null,
    column: null,
    response: {},

    oninit: function (vnode) {
        this.dbname = vnode.attrs.dbname
        this.tablename = vnode.attrs.tablename
        this.row = vnode.attrs.row
        this.column = vnode.attrs.column
    },

    onRowDoubleClick: function () {
        this.row[this.column.Field]._isEditing = !this.row[this.column.Field]._isEditing
    },

    onRowEnterKey: function (e) {
        e.preventDefault()
        this.row[this.column.Field]._isEditing = false
        console.log(this.row[this.column.Field]["data"])
    },

    view: function (vnode) {

        var self = this

        var toShow
        var input = (
            <form onsubmit={self.onRowEnterKey.bind(self)}>
                <input
                type="text"
                value={self.row[self.column.Field]["data"]()}
                onchange={m.withAttr("value", self.row[self.column.Field]["data"])}
                style="width:100%;"
                />
            </form>
        )

        if(self.row[self.column.Field]._isEditing) {
            toShow = input
        } else {
            toShow = self.row[self.column.Field]["data"]()
        }

        return (
            <td
                ondblclick={self.onRowDoubleClick.bind(self)}
            >
                {toShow}
            </td>
        );
    }

}