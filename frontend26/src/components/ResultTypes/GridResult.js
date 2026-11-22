import { Link } from "react-router-dom"

const GridResult = ({ data }) => {
    return (
        <tr className="grid-result">
            <td><Link to={`/wildlife/${data.id}`}>{data.name}</Link></td>
            <td className="italic" translate="no">{data.scientific_name}</td>
        </tr>
    )
}

export default GridResult