/** @jsx m */

import m from 'mithril'

export default  {

    oninit: function () {

    },

    view: function (vnode) {
        return (
            <div {...vnode.attrs} className="w3-padding-top">
                {vnode.children}
            </div>
        );
    }

}