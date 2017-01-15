import React from 'react'

class Alert extends React.Component {

    constructor(props) {
        super(props)
    }

    render() {
        let self = this
        return (
            <div className={"alert alert-" + (self.props.type || "success")} role="alert">
                {self.props.children}
            </div>
        )
    }

}

export default Alert