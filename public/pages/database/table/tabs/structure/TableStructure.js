import React from 'react'
import Http from '../../../../../services/Http'
import Util from '../../../../../services/Util'
import {Link} from 'react-router'
import Button from '../../../../../components/Button'

/*
 * List structure in this component for a selected tablename
 */

class TableStructure extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            columns: []
        }

        this.dropColumn = this.dropColumn.bind(this)
    }

    componentDidMount() {
        this.listColumns()
    }

    listColumns() {

        const self = this
        const dbname = self.props.dbname
        const tablename = self.props.tablename

        Http.post("/table/column/list", {dbname: dbname, tablename: tablename})
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    columns: r.data.payload
                })
            })
    }

    dropColumn(column) {



        const self = this
        const dbname = self.props.dbname
        const tablename = self.props.tablename
        let dropTable = false

        // if there is 1 column, we should drop the table
        if(self.state.columns.length == 1) {
            dropTable = true
        }

        let alertStr = "Are you sure to drop this column?" + "\n" + column

        if(dropTable) {
            alertStr = alertStr + "\n" + "Table will be dropped because it's last column"
        }

        if(!confirm(alertStr)) {
            return
        }

        Http.post("/column/drop", {dbname: dbname, tablename: tablename, column: column, dropTable: dropTable})
            .then(function (r) {

                if(r.data.code == 400) {
                    alert(r.data.message)
                } else {
                    alert(r.data.message)

                    if(r.data.payload.tableDropped) {
                        document.location.href = "/database/" + dbname
                    } else {
                        self.listColumns()
                    }
                }

            })
    }

    render() {

        const self = this
        const columns = self.state.columns

        return (
            <div>
                <table className="table table-sm table-hover table-striped">
                    <thead>
                    <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Null?</th>
                        <th>Default</th>
                        <th>Operations</th>
                    </tr>
                    </thead>
                    <tbody>
                    {
                        columns.map(function (col, idx) {
                            return (
                                <tr key={idx}>
                                    <td className="pointer">
                                        {(col.Key == "PRI") ? <span><i className="fa fa-key"/>&nbsp;</span> : null}
                                        {col.Field}
                                    </td>
                                    <td className="pointer">{col.Type}</td>
                                    <td className="pointer">{col.Null}</td>
                                    <td className="pointer">{col.Default}</td>
                                    <td>
                                        <Button type="danger" small onClick={() => {self.dropColumn(col.Field)}}>drop</Button>
                                    </td>
                                </tr>
                            )
                        })
                    }
                    </tbody>
                </table>
            </div>
        )
    }

}

export default TableStructure