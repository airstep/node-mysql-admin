import React from 'react'
import Column from './Column'

/*
*  A table row, that contains columns in TableRows component
* */

class Row extends React.Component {

    constructor(props) {
        super(props)
    }

    componentDidMount() {}

    render() {

        const self = this
        const props = this.props
        let columns  = props.columns
        let row  = props.row

        return (
            <tr>
                {
                    columns.map(function (col, idx) {
                        return <Column
                            key={idx}
                            row={row}
                            field={col.Field}
                            dbname={props.dbname}
                            tablename={props.tablename}
                        />
                    })
                }
            </tr>
        )
    }

}

Row.propTypes = {
    columns: React.PropTypes.array.isRequired,
    row: React.PropTypes.object.isRequired,
    dbname: React.PropTypes.string.isRequired,
    tablename: React.PropTypes.string.isRequired,
};

export default Row