import {browserHistory} from 'react-router'

const Util = {

    redirect(url) {
        browserHistory.push(url)
    }

}

export default Util