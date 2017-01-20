import React from 'react'

/*
*  column of each Row
* */

class Column extends React.Component {

    constructor(props) {
        super(props)
    }

    componentDidMount() {}

    render() {

        const self = this
        const props = this.props
        let field  = props.field
        let row  = props.row

        return (
            <td>
                {row[field]}
            </td>
        )
    }

}

Column.propTypes = {
    field: React.PropTypes.string.isRequired,
    row: React.PropTypes.object.isRequired,
    dbname: React.PropTypes.string.isRequired,
    tablename: React.PropTypes.string.isRequired,
};

export default Column