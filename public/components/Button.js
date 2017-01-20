import React from 'react'

class Button extends React.Component {

    constructor(props) {
        super(props)
    }

    render () {

        let self = this
        const {small, type} = self.props

        return (
            <span className={"pointer btn btn-" + (type || "primary") + (small ? " btn-sm" : "")} onClick={self.props.onClick}>
                {self.props.children}
            </span>
        )
    }

}

export default Button