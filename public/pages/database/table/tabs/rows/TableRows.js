import React from 'react'
import Http from '../../../../../services/Http'
import {Link} from 'react-router'
import Row from './component/Row'

/*
 * List structure in this component for a selected tablename
 */

class TableRows extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            columns: [],
            rows: [],
            page: 0
        }
    }

    componentDidMount() {

        /* first list structure, because we need them to show in table <thead/> */
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

                self.listRows()
            })
    }

    listRows() {

        const self = this
        const dbname = self.props.dbname
        const tablename = self.props.tablename

        Http.post("/table/rows", {dbname: dbname, tablename: tablename, page: self.state.page})
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    rows: r.data.payload
                })
            })
    }

    render() {

        const self = this
        const columns = self.state.columns
        const rows = self.state.rows

        return (
            <div>
                <table className="table table-sm table-hover table-striped">
                    <thead>
                        <tr>
                            {
                                columns.map(function (col, idx) {
                                    return <th key={idx}>{col.Field}</th>
                                })
                            }
                        </tr>
                    </thead>
                    <tbody>
                    {
                        rows.map(function (row, idx) {
                            return <Row
                                key={idx}
                                dbname={self.props.dbname}
                                tablename={self.props.tablename}
                                columns={columns}
                                row={row}
                            />
                        })
                    }
                    </tbody>
                </table>
            </div>
        )
    }

}

export default TableRows