import React from 'react'
import {Link} from 'react-router'

/*
* this component lives in App
* top of content
* */

class DatabaseBreadCrumb extends React.Component {

    constructor(props) {
        super(props)
    }

    render() {

        const self = this
        const props = self.props
        const dbname = props.params.dbname
        const tablename = props.params.tablename

        return (
            <div>
                <nav className="breadcrumb">
                    <Link className="breadcrumb-item"to="/">Home</Link>

                    {dbname ? <Link className={"breadcrumb-item " + (tablename ? "" : "active")} to={"/database/" + dbname}>{dbname}</Link> : null }
                    {tablename ? <Link  className={"breadcrumb-item active"} to={"/database/" + dbname + "/" + tablename}>{tablename}</Link> : null }

                </nav>
            </div>
        )
    }

}

export default DatabaseBreadCrumb