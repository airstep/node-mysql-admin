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

        this.setPageByInput = this.setPageByInput.bind(this)
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

                self.listRows(self.state.page)
            })
    }

    listRows(page) {

        const self = this
        const dbname = self.props.dbname
        const tablename = self.props.tablename

        self.setState({
            page: page
        })

        Http.post("/table/rows", {dbname: dbname, tablename: tablename, page: page})
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    rows: r.data.payload
                })
            })
    }

    setPageByInput(e) {
        this.setState({
            page: e.target.value
        })
    }

    render() {

        const self = this
        const columns = self.state.columns
        const rows = self.state.rows
        let page = self.state.page

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

                {/* pagination */}
                <ul className="pagination">
                    <li className="page-item" onClick={() => {self.listRows(--page)}}>
                        <a className="page-link" href="#" aria-label="Next">
                            <span aria-hidden="true">&laquo;</span>
                            <span className="sr-only">Next</span>
                        </a>
                    </li>
                    <li className="page-item"><a className="page-link" href="#">{page}</a></li>
                    <li className="page-item" onClick={() => {self.listRows(++page)}}>
                        <a className="page-link" href="#" aria-label="Next">
                            <span aria-hidden="true">&raquo;</span>
                            <span className="sr-only">Next</span>
                        </a>
                    </li>
                </ul>

                {/* go to page area */}
                <div className="input-group" style={{width: 250}}>

                    <input type="text" className="form-control" placeholder="Go to page" onChange={self.setPageByInput}/>

                    <span className="input-group-btn">
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {self.listRows(page)}}>
                            Go
                        </button>
                    </span>

                </div>

            </div>
        )
    }

}

export default TableRows